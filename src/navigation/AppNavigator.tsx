import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { TrainingScreen } from '../screens/TrainingScreen';
import { MissionsScreen } from '../screens/MissionsScreen';
import { EnfermariaScreen } from '../screens/EnfermariaScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { VillageScreen } from '../screens/VillageScreen';
import { BlacksmithScreen } from '../screens/BlacksmithScreen';
import { PantheonScreen } from '../screens/PantheonScreen';
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { DailyQuestsScreen } from '../screens/DailyQuestsScreen';
import { WeeklyScreen } from '../screens/WeeklyScreen';
import { GuildScreen } from '../screens/GuildScreen';
import { LegacyScreen } from '../screens/LegacyScreen';
import { ZoneMapScreen } from '../screens/ZoneMapScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CollectionScreen } from '../screens/CollectionScreen';
import { PrivacyScreen } from '../screens/PrivacyScreen';
import { TermsScreen } from '../screens/TermsScreen';
import { theme } from '../theme';
import { Icon, IconName } from '../components/ui/Icon';

export const TAB_ICONS: Record<string, IconName> = {
  Vila: 'castle',
  Treinamento: 'sword',
  'Missões': 'map-marker-path',
  Enfermaria: 'medical-bag',
  Loja: 'store',
};

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneContainerStyle: { backgroundColor: theme.colors.bgBase },
          tabBarStyle: {
            backgroundColor: theme.colors.surfaceRaised,
            borderTopColor: theme.colors.borderGold,
            height: 60,
            paddingBottom: 10,
            ...theme.elevation.e2,
          },
          tabBarActiveTintColor: theme.colors.gold,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarIcon: ({ color, size }) => (
            <Icon name={TAB_ICONS[route.name] ?? 'castle'} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen
          name="Vila"
          component={VillageScreen}
          options={{ tabBarLabel: 'Vila' }}
        />
        <Tab.Screen
          name="Treinamento"
          component={TrainingScreen}
          options={{ tabBarLabel: 'Treino' }}
        />
        <Tab.Screen
          name="Missões"
          component={MissionsScreen}
          options={{ tabBarLabel: 'Missões' }}
        />
        <Tab.Screen
          name="Enfermaria"
          component={EnfermariaScreen}
          options={{ tabBarLabel: 'Saúde' }}
        />
        <Tab.Screen 
          name="Loja" 
          component={ShopScreen} 
          options={{ tabBarLabel: 'Loja' }} 
        />
        
        {/* Hidden routes for Ferreiro and Panteão - navigated to from Vila but not shown as tabs */}
        <Tab.Screen
          name="Ferreiro"
          component={BlacksmithScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Panteao"
          component={PantheonScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Conquistas"
          component={AchievementsScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="MissoesDiarias"
          component={DailyQuestsScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Semanal"
          component={WeeklyScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Guilda"
          component={GuildScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Legado"
          component={LegacyScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="MapaZonas"
          component={ZoneMapScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Configuracoes"
          component={SettingsScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Colecao"
          component={CollectionScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        {/* Hidden legal screens — linked from SettingsScreen */}
        <Tab.Screen
          name="Privacidade"
          component={PrivacyScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Termos"
          component={TermsScreen}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
